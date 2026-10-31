import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const leanMock = vi.fn();
const countDocumentsMock = vi.fn();
vi.mock("@/models/Notification", () => ({
    default: {
        find: () => ({
            sort: () => ({
                limit: () => ({
                    populate: () => ({
                        populate: () => ({ lean: () => leanMock() }),
                    }),
                }),
            }),
        }),
        countDocuments: (...args: unknown[]) => countDocumentsMock(...args),
    },
}));

vi.mock("@/models/User", () => ({ default: {} }));
vi.mock("@/models/Post", () => ({ default: {} }));

const { GET } = await import("@/app/api/notifications/route");

function makeRequest() {
    return new NextRequest("http://localhost/api/notifications");
}

describe("GET /api/notifications", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "user-1", role: "reader" } });
        leanMock.mockReset().mockResolvedValue([]);
        countDocumentsMock.mockReset().mockResolvedValue(0);
    });

    it("returns 401 for an unauthenticated request", async () => {
        authMock.mockResolvedValue(null);
        const response = await GET(makeRequest(), {});
        expect(response.status).toBe(401);
    });

    it("shapes populated notifications and the unread count for the session user", async () => {
        leanMock.mockResolvedValue([
            {
                _id: "notif-1",
                type: "comment_reply",
                read: false,
                createdAt: new Date("2026-01-01"),
                actorId: { username: "priya" },
                postId: { title: "Docker for Developers", slug: "docker-for-developers" },
                commentId: "comment-1",
            },
        ]);
        countDocumentsMock.mockResolvedValue(3);

        const response = await GET(makeRequest(), {});
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.unreadCount).toBe(3);
        expect(body.data.notifications[0]).toEqual(
            expect.objectContaining({
                id: "notif-1",
                type: "comment_reply",
                actorUsername: "priya",
                postTitle: "Docker for Developers",
                postSlug: "docker-for-developers",
            })
        );
    });

    it("falls back to nulls when actor or post is missing (e.g. deleted)", async () => {
        leanMock.mockResolvedValue([
            {
                _id: "notif-1",
                type: "post_approved",
                read: true,
                createdAt: new Date("2026-01-01"),
                actorId: null,
                postId: null,
                commentId: null,
            },
        ]);

        const response = await GET(makeRequest(), {});
        const body = await response.json();

        expect(body.data.notifications[0]).toEqual(
            expect.objectContaining({ actorUsername: null, postTitle: null, postSlug: null })
        );
    });
});
