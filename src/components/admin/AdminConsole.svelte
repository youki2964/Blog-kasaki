<script lang="ts">
	let token = "";
	let message = "";
	let content = "";
	let location = "";
	let pinned = false;
	let busy = false;
	let action = "create-dynamic";
	let path = "";
	let postDraft = false;
	let announcement = "";
	let announcementTitle = "";
	let wallpaperPath = "src/assets/images/DesktopWallpaper/";
	let wallpaperName = "";
	let wallpaperData = "";

	async function request(body: Record<string, unknown>) {
		const response = await fetch("/api/admin/content", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
		const result = await response.json();
		message = result.message || (response.ok ? "操作成功，等待构建发布。" : "操作失败");
	}
	async function submit() {
		busy = true;
		try {
			if (action === "create-dynamic") await request({ action, content, location, pinned });
			if (action === "update-post") await request({ action, path, draft: postDraft, pinned });
			if (action === "delete") { if (!confirm(`确认删除 ${path}？删除可通过 Git 历史恢复。`)) return; await request({ action, path }); }
			if (action === "update-announcement") await request({ action, content: announcement, title: announcementTitle });
			if (action === "upload-wallpaper") await request({ action, path: wallpaperPath + wallpaperName, content: wallpaperData });
			if (action === "delete-wallpaper") { if (!confirm(`确认删除 ${path}？`)) return; await request({ action, path }); }
		} catch { message = "无法连接管理接口。"; } finally { busy = false; }
	}
</script>
<section class="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
	<h1 class="mb-2 text-2xl font-bold">博客管理后台</h1>
	<p class="mb-6 text-sm opacity-70">操作会通过 GitHub API 提交并触发部署。</p>
	<label class="mb-4 block text-sm">管理令牌<input class="mt-1 w-full rounded-lg border p-2" type="password" bind:value={token} /></label>
	<label class="mb-4 block text-sm">操作<select class="mt-1 w-full rounded-lg border p-2" bind:value={action}><option value="create-dynamic">发布动态</option><option value="update-post">文章发布/置顶</option><option value="delete">删除文章或动态</option><option value="update-announcement">更新公告</option><option value="upload-wallpaper">上传背景图</option><option value="delete-wallpaper">删除背景图</option></select></label>
	{#if action === "create-dynamic"}
		<label class="mb-4 block text-sm">内容<textarea class="mt-1 min-h-32 w-full rounded-lg border p-2" bind:value={content}></textarea></label><label class="mb-4 block text-sm">地点<input class="mt-1 w-full rounded-lg border p-2" bind:value={location} /></label><label class="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={pinned} /> 置顶</label>
	{:else if action === "update-post"}
		<label class="mb-4 block text-sm">文件路径<input class="mt-1 w-full rounded-lg border p-2" bind:value={path} placeholder="src/content/posts/example.md" /></label><label class="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={postDraft} /> 草稿</label><label class="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={pinned} /> 置顶</label>
	{:else if action === "delete" || action === "delete-wallpaper"}
		<label class="mb-4 block text-sm">文件路径<input class="mt-1 w-full rounded-lg border p-2" bind:value={path} /></label>
	{:else if action === "update-announcement"}
		<label class="mb-4 block text-sm">标题<input class="mt-1 w-full rounded-lg border p-2" bind:value={announcementTitle} /></label><label class="mb-4 block text-sm">公告内容<textarea class="mt-1 min-h-24 w-full rounded-lg border p-2" bind:value={announcement}></textarea></label>
	{:else}
		<label class="mb-4 block text-sm">目录<select class="mt-1 w-full rounded-lg border p-2" bind:value={wallpaperPath}><option>src/assets/images/DesktopWallpaper/</option><option>src/assets/images/MobileWallpaper/</option></select></label><label class="mb-4 block text-sm">文件名<input class="mt-1 w-full rounded-lg border p-2" bind:value={wallpaperName} /></label><label class="mb-4 block text-sm">Base64 图片内容<textarea class="mt-1 min-h-24 w-full rounded-lg border p-2" bind:value={wallpaperData}></textarea></label>
	{/if}
	<button class="rounded-lg bg-sky-600 px-4 py-2 text-white disabled:opacity-50" disabled={busy || !token} onclick={submit}>执行操作</button>{#if message}<p class="mt-4 text-sm">{message}</p>{/if}
</section>
