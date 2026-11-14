export type ReviewPeriod = {
  start: number;
  end: number;
  up: number;
  down: number;
};
export type ReviewHistory = {
  appid: number;
  granularity: string;
  checked_at: string;
  periods: ReviewPeriod[];
};
export async function getReviewHistory(
  appid: number,
): Promise<ReviewHistory | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/search/review-history/${appid}.json`,
      { next: { revalidate: 3600 } },
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
