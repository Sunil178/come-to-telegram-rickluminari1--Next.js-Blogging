import { beforeEach, describe, expect, it, vi } from "vitest";

const recordsMock = vi.fn();
const postsMock = vi.fn();
const adminsMock = vi.fn();
const bulkWriteMock = vi.fn();
const lean = (result: () => unknown) => ({ select: () => ({ lean: async () => result() }) });
vi.mock("@/models/Upload", () => ({ default: { find: () => lean(recordsMock), bulkWrite: (...args: unknown[]) => bulkWriteMock(...args) } }));
vi.mock("@/models/Post", () => ({ default: { find: () => lean(postsMock) } }));
vi.mock("@/models/User", () => ({ default: { find: () => lean(adminsMock) } }));
vi.mock("@/models/PostRevision", () => ({ default: {} }));

const { postUploadUrls, syncUploadPrivacy } = await import("@/libs/upload-privacy");

const file = "/uploads/2026-11-04/a.png";
const html = `<p><img src="${file}"></p>`;
const record = (access: string, userId = "author") => ({ _id: "r1", url: file, userId, access });
const post = (userId: string, visibility: boolean, content = html) => ({ userId, visibility, bannerImage: "", content });
const accessSet = () => bulkWriteMock.mock.calls[0]?.[0][0].updateOne.update.$set.access;

describe("syncUploadPrivacy", () => {
    beforeEach(() => {
        bulkWriteMock.mockReset().mockResolvedValue({});
        adminsMock.mockReset().mockResolvedValue([]);
    });

    it("reads the banner and body images of a post", () => {
        expect(postUploadUrls({ bannerImage: "/uploads/b.png", content: html })).toEqual(["/uploads/b.png", file]);
        expect(postUploadUrls({ bannerImage: "https://example.com/x.png", content: "" })).toEqual([]);
    });

    it("makes a draft image public once a shared post by its uploader uses it", async () => {
        recordsMock.mockResolvedValue([record("draft")]);
        postsMock.mockResolvedValue([post("author", true)]);
        await syncUploadPrivacy([file]);
        expect(accessSet()).toBe("public");
    });

    it("makes an image private while only its uploader's private posts use it", async () => {
        recordsMock.mockResolvedValue([record("public")]);
        postsMock.mockResolvedValue([post("author", false)]);
        await syncUploadPrivacy([file]);
        expect(accessSet()).toBe("private");
    });

    it("doesn't let someone else's shared post make a private image public", async () => {
        recordsMock.mockResolvedValue([record("private")]);
        postsMock.mockResolvedValue([post("author", false), post("stranger", true)]);
        await syncUploadPrivacy([file]);
        expect(bulkWriteMock).not.toHaveBeenCalled();
    });

    it("keeps an admin's upload public in someone else's shared post", async () => {
        recordsMock.mockResolvedValue([record("draft", "admin")]);
        postsMock.mockResolvedValue([post("author", true)]);
        adminsMock.mockResolvedValue([{ _id: "admin" }]);
        await syncUploadPrivacy([file]);
        expect(accessSet()).toBe("public");
    });

    it("leaves an image no post uses any more as it is", async () => {
        recordsMock.mockResolvedValue([record("public")]);
        postsMock.mockResolvedValue([]);
        await syncUploadPrivacy([file]);
        expect(bulkWriteMock).not.toHaveBeenCalled();
    });
});
