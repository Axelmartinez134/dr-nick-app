import ReviewPageClient from "./review-page-client";

export default async function EditorReviewPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  return <ReviewPageClient token={token} />;
}

