import type { Question } from "../../content/schema.ts";

const TONE: Record<Question["status"], string> = { 想做: "want", 待想: "open", 已和导师讨论: "discussed", 放弃: "dropped" };

// 研究问题：没有时给一句空状态
export function QuestionList({ questions }: { questions: Question[] }) {
  if (!questions.length) return <p className="empty-note">还没有公开的研究问题。读论文、做项目时想到了就记下来。</p>;
  return (
    <ul className="questions">
      {questions.map((q) => (
        <li key={q.id} className={`question is-${TONE[q.status]}`}>
          <span className="stamp">{q.status}</span>
          <span className="question-text">
            {q.title}
            {q.note ? <span className="question-note">{q.note}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
