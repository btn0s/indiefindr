import { redirect } from "next/navigation";

interface GamePageProps {
  params: {
    id: string;
    title: string;
  };
}

export default function GamePage({ params }: GamePageProps) {
  // Redirect to the new combined route
  redirect(`/${params.id}/${params.title}`);
}

