// 页面和格式检查都要用的取值。单独放一个文件，页面引用它时不会把 zod 打包进去。
export const PAPER_STATUSES = ["在读", "想读", "读完"] as const;
export const QUESTION_STATUSES = ["想做", "待想", "已和导师讨论", "放弃"] as const;
