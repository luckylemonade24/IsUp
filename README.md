# IsUp
服务状态监控
打开index.html搜索ILOVEYOUYOULOVEME替换为uptimerobot状态页面ID(看创建状态页面的链接"https://stats.uptimerobot.com/这里是状态ID")
再本地打开index.html按F12打开开发人员工具，切换至控制台输入
```
(async function() {
  const encoder = new TextEncoder();
  const algo = 'SHA-256';
  const getHash = async (text) => {
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest(algo, data);
    const hashArray = new Uint8Array(hashBuffer);
    return btoa(String.fromCharCode(...hashArray));
  };
  const tags = [...document.querySelectorAll('script:not([src]), style')];
  for (const el of tags) {
    const content = el.textContent;
    if (!content.trim()) continue;
    const hash = await getHash(content);
    console.log(`<${el.tagName.toLowerCase()}> -> 'sha256-${hash}'`);
  }
})();
```
打开_headers把控制台输出的两个sha256开头的哈希值替换掉原来的
直接Cloudflare Pages上传即可
