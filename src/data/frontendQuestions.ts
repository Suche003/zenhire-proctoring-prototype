import type { AssessmentQuestion } from '../types/assessment'

export const frontendQuestions: AssessmentQuestion[] = [
  {
    id: 'react-controlled-inputs',
    type: 'multiple-choice',
    category: 'React',
    title: 'Controlled form state',
    prompt:
      'A React input should always reflect the latest value stored in component state. Which implementation best describes a controlled input?',
    options: [
      {
        id: 'a',
        label: 'A',
        text: 'Use value from state and update that state in the onChange handler.',
      },
      {
        id: 'b',
        label: 'B',
        text: 'Use defaultValue and read the DOM only after form submission.',
      },
      {
        id: 'c',
        label: 'C',
        text: 'Store the value in a module variable outside the component.',
      },
      {
        id: 'd',
        label: 'D',
        text: 'Use placeholder text as the source of truth for the input.',
      },
    ],
  },
  {
    id: 'react-effect-dependencies',
    type: 'multiple-choice',
    category: 'React',
    title: 'Effect dependencies',
    prompt:
      'A component fetches candidate details whenever candidateId changes. What should the effect dependency array include?',
    options: [
      {
        id: 'a',
        label: 'A',
        text: 'The candidateId value and any referenced stable helpers that can change.',
      },
      {
        id: 'b',
        label: 'B',
        text: 'An empty array, because data fetching should only happen once.',
      },
      {
        id: 'c',
        label: 'C',
        text: 'Every state setter returned by useState.',
      },
      {
        id: 'd',
        label: 'D',
        text: 'No dependency array, because React automatically compares props.',
      },
    ],
  },
  {
    id: 'typescript-discriminated-union',
    type: 'multiple-choice',
    category: 'TypeScript',
    title: 'Typed UI states',
    prompt:
      'You need to model loading, success, and error states for an API response. Which TypeScript approach gives the clearest type narrowing?',
    options: [
      {
        id: 'a',
        label: 'A',
        text: 'A discriminated union with a shared status field.',
      },
      {
        id: 'b',
        label: 'B',
        text: 'A single object type where every property is optional.',
      },
      {
        id: 'c',
        label: 'C',
        text: 'Use any for the response until runtime data arrives.',
      },
      {
        id: 'd',
        label: 'D',
        text: 'Store all response variants as strings.',
      },
    ],
  },
  {
    id: 'javascript-event-loop',
    type: 'multiple-choice',
    category: 'JavaScript',
    title: 'Async execution order',
    prompt:
      'A Promise callback and a setTimeout callback are queued during the same call stack. Which one usually runs first after the stack clears?',
    options: [
      {
        id: 'a',
        label: 'A',
        text: 'The Promise microtask callback.',
      },
      {
        id: 'b',
        label: 'B',
        text: 'The setTimeout callback.',
      },
      {
        id: 'c',
        label: 'C',
        text: 'They always run at exactly the same time.',
      },
      {
        id: 'd',
        label: 'D',
        text: 'The order is random in modern browsers.',
      },
    ],
  },
  {
    id: 'css-responsive-layout',
    type: 'multiple-choice',
    category: 'HTML/CSS',
    title: 'Responsive layout',
    prompt:
      'A dashboard needs cards that wrap cleanly from desktop to mobile without fixed widths. Which CSS pattern is most appropriate?',
    options: [
      {
        id: 'a',
        label: 'A',
        text: 'CSS grid with repeat(auto-fit, minmax(...)) or a similar flexible layout.',
      },
      {
        id: 'b',
        label: 'B',
        text: 'Absolute positioning for every card.',
      },
      {
        id: 'c',
        label: 'C',
        text: 'A fixed 1440px container with overflow hidden.',
      },
      {
        id: 'd',
        label: 'D',
        text: 'Inline styles that change only when the page reloads.',
      },
    ],
  },
  {
    id: 'html-accessibility',
    type: 'true-false',
    category: 'HTML/CSS',
    title: 'Semantic buttons',
    prompt:
      'True or false: A clickable div is usually equivalent to a button for keyboard and screen reader users.',
    options: [
      {
        id: 'true',
        label: 'True',
        text: 'A clickable div is usually equivalent to a button.',
      },
      {
        id: 'false',
        label: 'False',
        text: 'A native button provides expected keyboard and accessibility behavior by default.',
      },
    ],
  },
  {
    id: 'react-list-keys',
    type: 'true-false',
    category: 'React',
    title: 'Stable list keys',
    prompt:
      'True or false: Using an array index as a React key is always safe, even when list items can be reordered or removed.',
    options: [
      {
        id: 'true',
        label: 'True',
        text: 'Array indexes are always safe keys.',
      },
      {
        id: 'false',
        label: 'False',
        text: 'Stable item identifiers are safer when lists can change order.',
      },
    ],
  },
  {
    id: 'typescript-generics',
    type: 'multiple-choice',
    category: 'TypeScript',
    title: 'Reusable typed functions',
    prompt:
      'A helper returns the first item from an array while preserving the item type. What TypeScript feature is the best fit?',
    options: [
      {
        id: 'a',
        label: 'A',
        text: 'A generic function such as first<T>(items: T[]): T | undefined.',
      },
      {
        id: 'b',
        label: 'B',
        text: 'A function that returns any.',
      },
      {
        id: 'c',
        label: 'C',
        text: 'A function that converts every item to a string.',
      },
      {
        id: 'd',
        label: 'D',
        text: 'A function overload for every possible array type.',
      },
    ],
  },
  {
    id: 'problem-solving-short-answer',
    type: 'short-answer',
    category: 'Problem-solving',
    title: 'Debugging approach',
    prompt:
      'A candidate reports that their answer disappeared after the browser resized during an assessment. In 3-5 sentences, describe how you would investigate and communicate the issue.',
  },
  {
    id: 'frontend-performance',
    type: 'multiple-choice',
    category: 'JavaScript',
    title: 'Performance triage',
    prompt:
      'A React assessment page feels slow when typing in a notes field. Which first step best helps identify the source of the slowdown?',
    options: [
      {
        id: 'a',
        label: 'A',
        text: 'Profile renders and input latency with browser and React developer tools.',
      },
      {
        id: 'b',
        label: 'B',
        text: 'Remove TypeScript from the project.',
      },
      {
        id: 'c',
        label: 'C',
        text: 'Move every component into one large file.',
      },
      {
        id: 'd',
        label: 'D',
        text: 'Disable all keyboard input until the next release.',
      },
    ],
  },
]
