import type { APIRoute } from "astro";

export const prerender = false;

type AdminBody = {
	action?: string;
	path?: string;
	content?: string;
	location?: string;
	title?: string;
	draft?: boolean;
	pinned?: boolean;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
const cleanPath = (value: string) => value.replaceAll("\\", "/").replace(/^\/+/, "");
const allowedPath = (value: string) => (value.startsWith("src/content/posts/") || value.startsWith("src/content/dynamic/") || value === "src/config/announcementConfig.ts" || value.startsWith("src/assets/images/DesktopWallpaper/") || value.startsWith("src/assets/images/MobileWallpaper/")) && !value.includes("..") && !value.includes("\0");

export const POST: APIRoute = async ({ request }) => {
	const expected = import.meta.env.ADMIN_TOKEN;
	const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
	if (!expected || !provided || provided !== expected) return json({ message: "未授权" }, 401);
	const body = await request.json().catch(() => null) as AdminBody | null;
	if (!body?.action) return json({ message: "请求参数无效" }, 400);
	const owner = import.meta.env.GITHUB_OWNER;
	const repo = import.meta.env.GITHUB_REPO;
	const token = import.meta.env.GITHUB_TOKEN;
	const branch = import.meta.env.GITHUB_BRANCH || "main";
	if (!owner || !repo || !token) return json({ message: "未配置 GitHub 环境变量" }, 503);
	const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" };
	const api = (path: string) => `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
	const getFile = async (path: string) => { const response = await fetch(api(path), { headers }); if (!response.ok) throw new Error(`文件读取失败（${response.status}）`); return await response.json() as { sha: string; content?: string }; };
	const commitFile = async (path: string, content: string, message: string, sha?: string, encoded = false) => { const response = await fetch(api(path), { method: "PUT", headers, body: JSON.stringify({ message, content: encoded ? content : Buffer.from(content, "utf8").toString("base64"), branch, ...(sha ? { sha } : {}) }) }); if (!response.ok) throw new Error(`GitHub 提交失败（${response.status}）`); return await response.json() as { commit?: { sha?: string } }; };
	const deleteFile = async (path: string, message: string) => { const file = await getFile(path); const response = await fetch(api(path), { method: "DELETE", headers, body: JSON.stringify({ message, sha: file.sha, branch }) }); if (!response.ok) throw new Error(`GitHub 删除失败（${response.status}）`); };
	try {
		if (body.action === "create-dynamic") {
			if (!body.content?.trim()) return json({ message: "动态内容不能为空" }, 400);
			const now = new Date(); const stamp = now.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, ""); const path = `src/content/dynamic/${stamp.replace(/[- :]/g, "").slice(0, 14)}.md`;
			const markdown = ["---", `published: ${stamp}`, body.location?.trim() ? `location: ${body.location.trim()}` : "", body.pinned ? "pinned: true" : "", "---", "", body.content.trim(), ""].filter(Boolean).join("\n");
			const result = await commitFile(path, markdown, `feat: publish dynamic ${path.split("/").pop()}`); return json({ message: "动态提交成功，等待构建发布。", commit: result.commit?.sha });
		}
		if (body.action === "update-post") {
			const path = cleanPath(body.path || ""); if (!allowedPath(path) || !path.startsWith("src/content/posts/")) return json({ message: "文章路径无效" }, 400);
			const file = await getFile(path); const source = Buffer.from(file.content || "", "base64").toString("utf8");
			let content = source;
			content = content.replace(/^draft:\s*(true|false)\s*$/m, `draft: ${body.draft ? "true" : "false"}`);
			content = content.replace(/^pinned:\s*(true|false)\s*$/m, `pinned: ${body.pinned ? "true" : "false"}`);
			if (!/^draft:/m.test(content)) content = content.replace(/^---\r?\n/, `---\ndraft: ${body.draft ? "true" : "false"}\n`);
			if (!/^pinned:/m.test(content)) content = content.replace(/^---\r?\n/, `---\npinned: ${body.pinned ? "true" : "false"}\n`);
			const result = await commitFile(path, content, `chore: update post ${path.split("/").pop()}`, file.sha); return json({ message: "文章更新成功，等待构建发布。", commit: result.commit?.sha });
		}
		if (body.action === "delete" || body.action === "delete-wallpaper") {
			const path = cleanPath(body.path || ""); if (!allowedPath(path) || path === "src/config/announcementConfig.ts") return json({ message: "删除路径无效" }, 400);
			await deleteFile(path, `chore: delete ${path.split("/").pop()}`); return json({ message: "删除成功，Git 历史中仍可恢复。" });
		}
		if (body.action === "upload-wallpaper") {
			const path = cleanPath(`${body.path || ""}`); if (!allowedPath(path) || !(path.startsWith("src/assets/images/DesktopWallpaper/") || path.startsWith("src/assets/images/MobileWallpaper/"))) return json({ message: "背景图路径无效" }, 400);
			if (!body.content?.trim()) return json({ message: "图片 Base64 内容不能为空" }, 400);
			const result = await commitFile(path, body.content.replace(/^data:[^;]+;base64,/, ""), `feat: add wallpaper ${path.split("/").pop()}`, undefined, true); return json({ message: "背景图提交成功，等待构建发布。", commit: result.commit?.sha });
		}
		if (body.action === "update-announcement") {
			const file = await getFile("src/config/announcementConfig.ts"); const source = Buffer.from(file.content || "", "base64").toString("utf8");
			const content = source.replace(/content:\s*"[^"]*"/, `content: ${JSON.stringify(body.content || "")}`).replace(/title:\s*"[^"]*"/, `title: ${JSON.stringify(body.title || "")}`);
			const result = await commitFile("src/config/announcementConfig.ts", content, "chore: update announcement", file.sha); return json({ message: "公告更新成功，等待构建发布。", commit: result.commit?.sha });
		}
		return json({ message: "不支持的操作" }, 400);
	} catch (error) { return json({ message: error instanceof Error ? error.message : "操作失败" }, 502); }
};
