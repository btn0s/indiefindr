import { buildTrainerScreen } from "@/lib/trainer/sampler";
import { TrainerClient } from "./trainer-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trainer | IndieFindr",
  robots: { index: false, follow: false },
};

export default async function TrainerPage() {
  const screen = await buildTrainerScreen();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <TrainerClient key={screen.seed.appid} screen={screen} />
    </main>
  );
}
