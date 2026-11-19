/** Normalize provider records defensively. Only display fields needed for review. */
export interface ReviewSubmission { id: string; createdAt: string; answers: { label: string; value: string }[] }
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function submissionPage(value: unknown): { submissions: ReviewSubmission[]; hasMore: boolean } {
  const root = record(value);
  const data = record(root?.data) ?? root;
  if (!data || !Array.isArray(data.submissions) || !Array.isArray(data.questions) || typeof data.hasMore !== 'boolean') throw new Error('unrecognized_submission_response');
  const labels = new Map<string, string>();
  for (const item of data.questions) {
    const question = record(item);
    if (question && typeof question.id === 'string' && typeof question.label === 'string' && question.type !== 'HIDDEN_FIELDS') labels.set(question.id, question.label);
  }
  const submissions = data.submissions.filter((item: unknown) => record(item)?.isCompleted === true).map((item: unknown) => {
    const row = record(item);
    if (!row || typeof row.id !== 'string' || typeof row.submittedAt !== 'string' || !Array.isArray(row.responses))
      throw new Error('unrecognized_submission_record');
    return { id: row.id, createdAt: row.submittedAt, answers: row.responses.map((item: unknown) => {
      const answer = record(item);
      if (!answer || typeof answer.questionId !== 'string') throw new Error('unrecognized_submission_answer');
      const value = answer.answer;
      return { label: labels.get(answer.questionId) ?? '', value: typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value) };
    }).filter(answer => answer.label !== '') };
  });
  return {submissions, hasMore: data.hasMore};
}
export function reviewPageNumber(value: string | undefined): number {
  if (!value || !/^[1-9]\d{0,3}$/.test(value)) return 1;
  return Number(value);
}
