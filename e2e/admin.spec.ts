import { expect, login, newPage, SEEDED_POST, test, USERS } from "./fixtures";
import { createPost, createUser, withDb } from "./db";

test("an admin creates, renames and deletes categories, with clear refusals along the way", async ({ browser }) => {
    const adminPage = await newPage(browser);
    await login(adminPage, USERS.admin.email, undefined, "/dashboard/admin/categories");
    const name = `Cat ${Date.now()}`;

    await adminPage.getByRole("button", { name: "Add category" }).click();
    await adminPage.getByLabel("Title").fill(name);
    await adminPage.getByRole("button", { name: "Save" }).click();
    await expect(adminPage.getByText("Category created.")).toBeVisible();
    const row = (title: string) => adminPage.getByRole("row").filter({ hasText: title });
    await expect(row(name)).toBeVisible();

    // The same name twice is refused.
    await adminPage.getByRole("button", { name: "Add category" }).click();
    await adminPage.getByLabel("Title").fill(name);
    await adminPage.getByRole("button", { name: "Save" }).click();
    await expect(adminPage.getByText("A category with this name already exists")).toBeVisible();
    await adminPage.keyboard.press("Escape");

    const renamed = `${name} renamed`;
    await row(name).getByRole("button", { name: "Edit category" }).click();
    await adminPage.getByLabel("Title").fill(renamed);
    await adminPage.getByRole("button", { name: "Save" }).click();
    await expect(adminPage.getByText("Category updated.")).toBeVisible();
    await expect(row(renamed)).toBeVisible();

    // A category in use can't be deleted; cancelling the confirmation deletes nothing.
    const category = await withDb((db) => db.collection("categories").findOne({ title: renamed }));
    const author = await createUser(`e2e.catauthor${Date.now()}`, "author");
    const post = await createPost(author.id, { categoryId: category!._id });
    await row(renamed).getByRole("button", { name: "Delete category" }).click();
    await adminPage.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
    await expect(row(renamed)).toBeVisible();
    await row(renamed).getByRole("button", { name: "Delete category" }).click();
    await adminPage.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(adminPage.getByText("Reassign or remove this category's posts first")).toBeVisible();

    // Readers can filter by it.
    const reader = await newPage(browser);
    await reader.goto("/posts");
    await reader.getByRole("link", { name: renamed, exact: true }).click();
    await expect(reader.getByRole("link", { name: post.title }).first()).toBeVisible();
    await expect(reader.getByRole("link", { name: SEEDED_POST.title })).toHaveCount(0);

    await withDb((db) => db.collection("posts").updateOne({ _id: post.id }, { $unset: { categoryId: "" } }));
    await row(renamed).getByRole("button", { name: "Delete category" }).click();
    await adminPage.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(adminPage.getByText("Category deleted.")).toBeVisible();
    await expect(row(renamed)).toHaveCount(0);

    // A deleted name can be used again.
    await adminPage.getByRole("button", { name: "Add category" }).click();
    await adminPage.getByLabel("Title").fill(renamed);
    await adminPage.getByRole("button", { name: "Save" }).click();
    // The first "Category created." toast can still be on screen (phones keep toasts longer).
    await expect(adminPage.getByText("Category created.").last()).toBeVisible();
    await expect(row(renamed)).toHaveCount(1);
    await adminPage.context().close();
    await reader.context().close();
});

test("an admin finds a user, changes their role, and the user's access follows", async ({ browser }) => {
    const user = await createUser(`e2e.promote${Date.now()}`);
    const adminPage = await newPage(browser);
    await login(adminPage, USERS.admin.email, undefined, "/dashboard/admin/users");

    await adminPage.getByLabel("Search users").fill(user.username);
    await expect.poll(() => new URL(adminPage.url()).searchParams.get("q")).toBe(user.username);
    const row = adminPage.getByRole("row").filter({ hasText: user.email });
    await expect(adminPage.getByRole("row")).toHaveCount(2);
    await row.getByRole("button", { name: /Reader/ }).click();
    await adminPage.getByRole("menuitemradio", { name: "Moderator" }).click();
    await expect(adminPage.getByText("Role updated to Moderator.")).toBeVisible();
    expect(await withDb(async (db) => (await db.collection("users").findOne({ _id: user.id }))!.role)).toBe("moderator");

    // The admin's own role can't be changed.
    await adminPage.getByLabel("Search users").fill(USERS.admin.username);
    await expect(adminPage.getByRole("row").filter({ hasText: USERS.admin.email }).getByRole("button", { name: /Admin/ })).toBeDisabled();

    // The new moderator reaches the moderation queue but not user management.
    const moderatorPage = await newPage(browser);
    await login(moderatorPage, user.email, undefined, "/dashboard/admin/posts");
    await expect(moderatorPage).toHaveURL(/\/dashboard\/admin\/posts/);
    await moderatorPage.goto("/dashboard/admin/users");
    await expect(moderatorPage).toHaveURL(/\/dashboard\/posts/);
    const forbidden = await moderatorPage.request.patch(`/api/users/role/${user.id}`, { data: { role: "admin" } });
    expect(forbidden.status()).toBe(403);
    await adminPage.context().close();
    await moderatorPage.context().close();
});

test("an admin searches comments, pages through them and removes one after confirming", async ({ browser }) => {
    const author = await createUser(`e2e.modauthor${Date.now()}`, "author");
    const post = await createPost(author.id);
    const marker = `Spam ${Date.now()}`;
    await withDb(async (db) => {
        const now = Date.now();
        await db.collection("comments").insertMany(Array.from({ length: 22 }, (_, i) => ({
            postId: post.id, userId: author.id, parentId: null, content: `${marker} #${i}`, upvoteCount: 0, downvoteCount: 0, deleted: false,
            createdAt: new Date(now + i), updatedAt: new Date(now + i),
        })));
        await db.collection("posts").updateOne({ _id: post.id }, { $set: { commentCount: 22 } });
    });

    const adminPage = await newPage(browser);
    await login(adminPage, USERS.admin.email, undefined, "/dashboard/admin/comments");
    await adminPage.getByLabel("Search comments").fill(marker);
    await expect.poll(() => new URL(adminPage.url()).searchParams.get("q")).toBe(marker);
    await expect(adminPage.getByRole("row").filter({ hasText: marker })).toHaveCount(20);
    await adminPage.getByRole("link", { name: "Next" }).click();
    await expect(adminPage.getByRole("row").filter({ hasText: marker })).toHaveCount(2);

    const target = adminPage.getByRole("row").filter({ hasText: `${marker} #0` });
    await target.getByRole("button", { name: "Remove comment" }).click();
    await adminPage.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(adminPage.getByText("Comment removed.")).toBeVisible();
    await expect(target).toHaveCount(0);
    expect(await withDb(async (db) => (await db.collection("posts").findOne({ _id: post.id }))!.commentCount)).toBe(21);
    await adminPage.context().close();
});

test("non-admins can't reach admin pages or admin APIs", async ({ browser }) => {
    const authorPage = await newPage(browser);
    await login(authorPage, USERS.author.email, undefined, "/dashboard/posts");
    for (const path of ["/dashboard/admin/users", "/dashboard/admin/categories", "/dashboard/admin/requests", "/dashboard/admin/posts"]) {
        await authorPage.goto(path);
        await expect(authorPage).toHaveURL(/\/dashboard\/posts/);
    }
    expect((await authorPage.request.post("/api/categories", { data: { title: "Nope" } })).status()).toBe(403);
    expect((await authorPage.request.patch("/api/posts/e2e-welcome/approval", { data: { approval: "Rejected" } })).status()).toBe(403);
    await authorPage.context().close();
});
