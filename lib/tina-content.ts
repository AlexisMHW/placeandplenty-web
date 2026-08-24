// Wraps the client TinaCMS generates at build time (via `tinacms build`,
// which runs before `next build` — see package.json). Don't import
// tina/__generated__/client directly elsewhere; go through this file
// so there's one place to adjust if the generated path ever changes.

// @ts-ignore — generated at build time, not present in source control
import { client } from "../tina/__generated__/client";

export async function getAllPosts() {
  const result = await client.queries.postConnection();
  return (
    result.data.postConnection.edges
      ?.map((edge: any) => edge?.node)
      .filter((post: any) => post && post.status === "published") ?? []
  );
}

export async function getPostBySlug(slug: string) {
  const result = await client.queries.post({
    relativePath: `${slug}.mdx`,
  });
  return result.data.post;
}
