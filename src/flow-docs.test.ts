import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Flow documents (docs/flows/) cite the e2e tests that prove each flow; this keeps the citations,
// links and file references true when tests are renamed or files move.
const FLOWS = "docs/flows";
const docs = readdirSync(FLOWS).filter((file) => file.endsWith(".md")).map((file) => path.join(FLOWS, file));
const read = (file: string) => readFileSync(file, "utf8");

const e2eTests = new Set(
    readdirSync("e2e")
        .filter((file) => file.endsWith(".spec.ts"))
        .flatMap((file) => [...read(path.join("e2e", file)).matchAll(/^test\("([^"]+)"/gm)].map((match) => `${file} › ${match[1]}`))
);

function citations(text: string): string[] {
    return [...text.matchAll(/`e2e\/([\w.-]+\.spec\.ts)` › ((?:"[^"]+"(?:, )?)+)/g)].flatMap((match) =>
        [...match[2].matchAll(/"([^"]+)"/g)].map((name) => `${match[1]} › ${name[1]}`)
    );
}

describe("flow documents", () => {
    it.each(docs)("%s cites only e2e tests that exist", (doc) => {
        expect(citations(read(doc)).filter((citation) => !e2eTests.has(citation))).toEqual([]);
    });

    it("cite every e2e test somewhere", () => {
        const cited = new Set(docs.flatMap((doc) => citations(read(doc))));
        expect([...e2eTests].filter((test) => !cited.has(test))).toEqual([]);
    });

    it.each(docs)("%s links and names only files that exist", (doc) => {
        const text = read(doc);
        const links = [...text.matchAll(/\]\(([^)#<]+)\)/g)].map((match) => match[1]).filter((link) => !link.startsWith("http"));
        const missingLinks = links.filter((link) => !existsSync(path.join(path.dirname(doc), link)));
        const files = [...text.matchAll(/`((?:src|public|e2e)\/[^`*<]+)`/g)].map((match) => match[1]);
        expect([...missingLinks, ...files.filter((file) => !existsSync(file))]).toEqual([]);
    });
});
