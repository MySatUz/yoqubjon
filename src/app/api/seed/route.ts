import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST() {
  if (process.env.ENABLE_SEED_API !== "true") {
    return NextResponse.json({ error: "Seed endpoint disabled" }, { status: 404 });
  }

  try {
    await requireAdmin();
    console.log('Seeding SAT Math Practice Test 1...');

    await prisma.testCollectionVisibility.upsert({
      where: { category: 'STANDARD' },
      update: {
        label: 'Standard tests',
        description: 'Core SAT Math modules for regular practice.',
        position: 10,
        visible: true,
      },
      create: {
        category: 'STANDARD',
        label: 'Standard tests',
        description: 'Core SAT Math modules for regular practice.',
        position: 10,
        visible: true,
      },
    });

    const test1 = await prisma.test.upsert({
      where: { id: 'test-1-sat-math' },
      update: {
        collectionCategory: 'STANDARD',
        durationSeconds: 2 * 60 * 60,
        visible: true,
      },
      create: {
        id: 'test-1-sat-math',
        title: 'SAT Math Practice 1',
        description: 'Standard SAT Mathematics section with mixed Algebra, Geometry, and Advanced Math.',
        isFree: true,
        visible: true,
        durationSeconds: 2 * 60 * 60,
        collectionCategory: 'STANDARD',
      },
    });

    const questions = [
      {
        id: 'q1',
        testId: test1.id,
        content: 'If $3x + 6 = 18$, what is the value of $x - 2$?',
        options: ['2', '4', '6', '12'],
        correctAnswer: '2',
        explanation: 'First, solve for $x$: $3x = 18 - 6 \\Rightarrow 3x = 12 \\Rightarrow x = 4$. Then, find $x - 2$: $4 - 2 = 2$.',
        order: 1,
      },
      {
        id: 'q2',
        testId: test1.id,
        content: 'Which of the following is equivalent to the expression $x^2 - 6x + 9$?',
        options: ['$(x-3)^2$', '$(x+3)^2$', '$(x-3)(x+3)$', '$(x-9)(x+1)$'],
        correctAnswer: '$(x-3)^2$',
        explanation: 'The expression $x^2 - 6x + 9$ is a perfect square trinomial: $(x-3)^2 = x^2 - 2(3)x + 3^2 = x^2 - 6x + 9$.',
        order: 2,
      },
      {
        id: 'q3',
        testId: test1.id,
        content: 'In the $xy$-plane, a line passes through the points $(0, 3)$ and $(2, 7)$. What is the slope of the line?',
        options: ['2', '4', '1/2', '3'],
        correctAnswer: '2',
        explanation: 'Slope $m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{7 - 3}{2 - 0} = \\frac{4}{2} = 2$.',
        order: 3,
      },
      {
        id: 'q4',
        testId: test1.id,
        content: 'A rectangle has a length that is 5 more than its width. If the perimeter of the rectangle is 30, what is the width of the rectangle?',
        options: ['5', '10', '15', '20'],
        correctAnswer: '5',
        explanation: 'Let $w$ be the width. Then length $l = w + 5$. Perimeter $P = 2(l + w) = 2(w + 5 + w) = 2(2w + 5) = 4w + 10$. Given $P = 30$, we have $4w + 10 = 30 \\Rightarrow 4w = 20 \\Rightarrow w = 5$.',
        order: 4,
      },
      {
        id: 'q5',
        testId: test1.id,
        content: 'Solve for $x$: $\\sqrt{2x + 1} = 5$.',
        options: ['12', '24', '4', '6'],
        correctAnswer: '12',
        explanation: 'Square both sides: $2x + 1 = 25$. Then $2x = 24$, so $x = 12$.',
        order: 5,
      }
    ];

    for (const q of questions) {
      await prisma.question.upsert({
        where: { id: q.id },
        update: q,
        create: q,
      });
    }

    return NextResponse.json({ message: "Seeding completed successfully" });
  } catch (error: unknown) {
    console.error(error);
    const status = error instanceof Error && error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status }
    );
  }
}
