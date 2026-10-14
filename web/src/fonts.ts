// 手写字体从 Google Fonts 加载，放在页面显示之后再加，不挡住页面。
// 国内网络打不开 Google Fonts 时，就用系统里的楷体，页面照常显示。
const HAND_FONT_CSS = "https://fonts.googleapis.com/css2?family=Long+Cang&display=swap";

export function loadHandFont(): void {
  if (document.querySelector(`link[href="${HAND_FONT_CSS}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = HAND_FONT_CSS;
  document.head.append(link);
}
