import type { AssessmentQuestion } from '../types/assessment'

type QuestionCardProps = {
  answer: string
  disabled: boolean
  onAnswerChange: (answer: string) => void
  question: AssessmentQuestion
  questionNumber: number
  totalQuestions: number
}

function QuestionCard({
  answer,
  disabled,
  onAnswerChange,
  question,
  questionNumber,
  totalQuestions,
}: QuestionCardProps) {
  const isShortAnswer = question.type === 'short-answer'

  return (
    <article className="question-card" aria-label="Assessment question">
      <div className="question-prompt-panel">
        <p className="report-line">
          Encountering a problem? <button type="button">Report</button>
        </p>

        <div className="question-meta">
          <span>
            {questionNumber}. Question
          </span>
          <span>
            {question.category} - {questionNumber} of {totalQuestions}
          </span>
        </div>

        <h2>{question.title}</h2>
        <p className="question-copy">{question.prompt}</p>
      </div>

      <div className="question-answer-panel">
        {isShortAnswer ? (
          <label className="short-answer-field">
            <span>Your response</span>
            <textarea
              disabled={disabled}
              onChange={(event) => onAnswerChange(event.target.value)}
              placeholder="Type your answer here..."
              rows={10}
              value={answer}
            />
          </label>
        ) : (
          <fieldset className="answer-options" disabled={disabled}>
            <legend>
              {question.type === 'true-false'
                ? 'Select true or false'
                : 'Select one answer'}
            </legend>
            {question.options?.map((option) => (
              <label className="answer-option" key={option.id}>
                <input
                  checked={answer === option.id}
                  name={`assessment-answer-${question.id}`}
                  onChange={() => onAnswerChange(option.id)}
                  type="radio"
                  value={option.id}
                />
                <span className="answer-letter">{option.label}</span>
                <span className="answer-copy">{option.text}</span>
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </article>
  )
}

export default QuestionCard
