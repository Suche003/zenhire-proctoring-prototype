export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer'

export type AnswerOption = {
  id: string
  label: string
  text: string
}

export type AssessmentQuestion = {
  id: string
  type: QuestionType
  category: string
  title: string
  prompt: string
  options?: AnswerOption[]
}

export type AnswerMap = Record<string, string>
