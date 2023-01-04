import { DestinationBlogDir, DestinationScrapDir, DestinationSlideDir } from "../common/definition";
import { buildSlide } from "./build/slide";
import { mkdir, rm } from "node:fs/promises";
import { buildBlog } from "./build/blog";
import { buildScrap } from "./build/scrap";
import { buildSiteMap } from "./build/sitemap";
import { buildRss } from "./build/rss";
import { buildIndex } from "./build";
import { listAllPosts } from "../common/post";

const main = async () => {
  await Promise.all(
    [DestinationBlogDir, DestinationSlideDir, DestinationScrapDir].map(async (dirPath: string): Promise<void> => {
      await rm(dirPath, { recursive: true }).catch(() => undefined);
      await mkdir(dirPath, { recursive: true });
    })
  );

  const posts = await listAllPosts();
  const articlePosts = posts.filter(({ type }) => type === "articles");
  const memoPosts = posts.filter(({ type }) => type === "memo");
  const scrapPosts = posts.filter(({ type }) => type === "scrap");
  const slidePosts = posts.filter(({ type }) => type === "slide");
  console.log(
    [
      `Found ${posts.length} files: Article: ${articlePosts.length}`,
      `Memo: ${memoPosts.length}`,
      `Scrap: ${scrapPosts.length}`,
      `Slide: ${slidePosts.length}`,
    ].join(", ")
  );

  await Promise.all([
    buildBlog([...articlePosts, ...memoPosts]),
    buildSlide(slidePosts),
    buildScrap(scrapPosts),
    buildRss(articlePosts, "article"),
    buildRss(memoPosts, "memo"),
    buildRss(scrapPosts, "scrap"),
    buildIndex(posts),
  ]);
  await buildSiteMap();
};

main()
  .then(() => {
    console.log("BUILD COMPLETED");
  })
  .catch((err) => {
    console.error("BUILD FAILED");
    console.error(err);
    process.exit(1);
  });
