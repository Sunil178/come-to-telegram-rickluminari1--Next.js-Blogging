import { beforeEach, describe, expect, it, vi } from "vitest";

// Each model mock returns canned query results and logs every write, so ordering and filters can be checked.
const { log, data, model } = vi.hoisted(() => {
    const log: [string, string, unknown, unknown?][] = [];
    const data: Record<string, Record<string, unknown>> = {};
    const query = (value: unknown) => ({ select: () => ({ lean: async () => value }) });
    const model = (name: string) => ({
        find: (filter: unknown) => query(data[name]?.find ?? []),
        findWithDeleted: (filter: unknown) => query(data[name]?.findWithDeleted ?? []),
        findOneWithDeleted: (filter: unknown) => query(data[name]?.findOneWithDeleted ?? null),
        findOne: (filter: unknown) => query(data[name]?.findOne ?? null),
        findById: (id: unknown) => query(data[name]?.findById ?? null),
        exists: async (filter: unknown) => data[name]?.exists ?? null,
        updateManyWithDeleted: async (filter: unknown, update: unknown) => log.push([name, "updateManyWithDeleted", filter, update]),
        bulkWrite: async (ops: unknown) => log.push([name, "bulkWrite", ops]),
        deleteMany: async (filter: unknown) => log.push([name, "deleteMany", filter]),
        deleteOne: async (filter: unknown) => log.push([name, "deleteOne", filter]),
        updateOne: async (filter: unknown, update: unknown) => log.push([name, "updateOne", filter, update]),
        updateMany: async (filter: unknown, update: unknown) => log.push([name, "updateMany", filter, update]),
    });
    return { log, data, model };
});

for (const [path, name] of [["User", "User"], ["Post", "Post"], ["Comment", "Comment"], ["PostVote", "PostVote"], ["CommentVote", "CommentVote"], ["UserVote", "UserVote"], ["PostRevision", "PostRevision"], ["Notification", "Notification"], ["PushSubscription", "PushSubscription"], ["AuthToken", "AuthToken"], ["PublishRequest", "PublishRequest"], ["VisitorEvent", "VisitorEvent"], ["Upload", "Upload"], ["ContactMessage", "ContactMessage"]]) {
    vi.doMock(`@/models/${path}`, () => ({ default: model(name) }));
}
const unlinkMock = vi.fn(async (_path: string) => {});
vi.mock("node:fs/promises", () => ({ unlink: (path: string) => unlinkMock(path) }));
vi.mock("@/libs/uploads", () => ({ UPLOAD_URL_PREFIX: "/uploads", uploadRoot: () => "/data", resolveUploadPath: (segments: string[]) => `/data/${segments.join("/")}` }));

const { deleteAccount } = await import("@/libs/account-data");

const writes = (name: string, op: string) => log.filter(([n, o]) => n === name && o === op);

describe("deleteAccount", () => {
    beforeEach(() => {
        log.length = 0;
        for (const key of Object.keys(data)) delete data[key];
        unlinkMock.mockClear();
        data.Post = { findWithDeleted: [{ _id: "own-post", bannerImage: "/uploads/a.png", content: '<img src="/uploads/b.png"><img src="https://other.site/uploads/c.png">' }] };
        data.Comment = { findWithDeleted: [{ _id: "comment-on-own-post" }], find: [{ postId: "their-post" }, { postId: "their-post" }] };
        data.PostVote = { find: [{ postId: "their-post", type: true }] };
        data.CommentVote = { find: [{ commentId: "their-comment", type: false }] };
        data.UserVote = { find: [{ targetUserId: "other-user", type: true }] };
    });

    it("subtracts the user's votes and comments from other people's content only", async () => {
        await deleteAccount("u1");

        expect(writes("Post", "bulkWrite")[0][2]).toEqual([{ updateOne: { filter: { _id: "their-post" }, update: { $inc: { upvoteCount: -1 } } } }]);
        expect(writes("Comment", "bulkWrite")[0][2]).toEqual([{ updateOne: { filter: { _id: "their-comment" }, update: { $inc: { downvoteCount: -1 } } } }]);
        expect(writes("User", "bulkWrite")[0][2]).toEqual([{ updateOne: { filter: { _id: "other-user" }, update: { $inc: { upvoteCount: -1 } } } }]);
        expect(writes("Post", "bulkWrite")[1][2]).toHaveLength(2);
        expect(writes("Post", "bulkWrite")[1][2]).toContainEqual({ updateOne: { filter: { _id: "their-post" }, update: { $inc: { commentCount: -1 } } } });
    });

    it("erases the text of comments elsewhere and keeps them as placeholders", async () => {
        await deleteAccount("u1");
        const [, , filter, update] = writes("Comment", "updateManyWithDeleted")[0];
        expect(filter).toEqual({ userId: "u1", postId: { $nin: ["own-post"] } });
        expect(update).toMatchObject({ $set: { content: "[deleted]", deleted: true } });
    });

    it("deletes votes before correcting counters, and the user record last", async () => {
        await deleteAccount("u1");
        const order = log.map(([name, op]) => `${name}.${op}`);
        expect(order.indexOf("PostVote.deleteMany")).toBeLessThan(order.indexOf("Post.bulkWrite"));
        // Only file cleanup, which needs the upload records, follows the user record.
        expect(order.filter((op) => !op.startsWith("Upload.")).at(-1)).toBe("User.deleteOne");
        expect(order.at(-1)).toBe("Upload.deleteMany");
    });

    it("removes only this site's uploads that no other post still uses", async () => {
        data.Post.findOneWithDeleted = null;
        await deleteAccount("u1");
        expect(unlinkMock.mock.calls.map(([path]) => path).sort()).toEqual(["/data/a.png", "/data/b.png"]);

        unlinkMock.mockClear();
        data.Post.findOneWithDeleted = { _id: "someone-elses-post" };
        await deleteAccount("u1");
        expect(unlinkMock).not.toHaveBeenCalled();
    });

    it("removes uploads the user never used, and drops every upload record (and its photo metadata)", async () => {
        data.Upload = { find: [{ url: "/uploads/never-used.png" }] };
        await deleteAccount("u1");
        expect(unlinkMock.mock.calls.map(([path]) => path)).toContain("/data/never-used.png");
        expect(log).toContainEqual(["Upload", "deleteMany", { userId: "u1" }]);
    });

    it("keeps the user's contact messages on record but no longer tied to the account", async () => {
        await deleteAccount("u1");
        expect(log).toContainEqual(["ContactMessage", "updateMany", { userId: "u1" }, { $set: { userId: null } }]);
    });

    it("removes the profile photo too, unless another account uses the same file", async () => {
        data.User = { findById: { avatar: "/uploads/me.png" } };
        await deleteAccount("u1");
        expect(unlinkMock.mock.calls.map(([path]) => path)).toContain("/data/me.png");

        unlinkMock.mockClear();
        data.User = { findById: { avatar: "/uploads/me.png" }, findOneWithDeleted: { _id: "someone-else" } };
        await deleteAccount("u1");
        expect(unlinkMock.mock.calls.map(([path]) => path)).not.toContain("/data/me.png");
    });
});
