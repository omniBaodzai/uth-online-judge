const JUDGE0_URL = "http://judge0-local-server-1:2358";

async function main() {
  const sourceCode = `
#include <iostream>
using namespace std;

int main() {
    cout << "Hello World!";
    return 0;
}
`;

  const response = await fetch(
    `${JUDGE0_URL}/submissions?wait=true&base64_encoded=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language_id: 54,
        source_code: sourceCode,
        expected_output: "Hello World!",
      }),
      signal: AbortSignal.timeout(30000),
    },
  );

  const result = await response.json();

  console.log("HTTP Status:", response.status);
  console.log("Judge0 Status:", result.status?.description);
  console.log("Output:", result.stdout);
  console.log("Compile Output:", result.compile_output);
  console.log("Message:", result.message);
}

main().catch(console.error);
