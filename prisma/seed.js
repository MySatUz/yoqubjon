require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL || 'prisma+postgres://localhost:51213/?api_key=eyJkYXRhYmFzZVVybCI6InBvc3RncmVzOi8vcG9zdGdyZXM6cG9zdGdyZXNAbG9jYWxob3N0OjUxMjE0L3RlbXBsYXRlMT9zc2xtb2RlPWRpc2FibGUmY29ubmVjdGlvbl9saW1pdD0xMCZjb25uZWN0X3RpbWVvdXQ9MCZtYXhfaWRsZV9jb25uZWN0aW9uX2xpZmV0aW1lPTAmcG9vbF90aW1lb3V0PTAmc29ja2V0X3RpbWVvdXQ9MCIsIm5hbWUiOiJkZWZhdWx0Iiwic2hhZG93RGF0YWJhc2VVcmwiOiJwb3N0Z3JlczovL3Bvc3RncmVzOnBvc3RncmVzQGxvY2FsaG9zdDo1MTIxNS90ZW1wbGF0ZTE_c3NsbW9kZT1kaXNhYmxlJmNvbm5lY3Rpb25fbGltaXQ9MTAmY29ubmVjdF90aW1lb3V0PTAmbWF4X2lkbGVfY29ubmVjdGlvbl9saWZldGltZT0wJnBvb2xfdGltZW91dD0wJnNvY2tldF90aW1lb3V0PTAifQ',
});

async function main() {
  console.log('Seeding SAT Math Practice Test 1...');

  const test1 = await prisma.test.upsert({
    where: { id: 'test-1-sat-math' },
    update: {},
    create: {
      id: 'test-1-sat-math',
      title: 'SAT Math Practice 1',
      description: 'Standard SAT Mathematics section with mixed Algebra, Geometry, and Advanced Math.',
      isFree: true,
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

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
