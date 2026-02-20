
import { parse } from "./src/parser.js";

const tests = [
    "f(x)",
    "F(x)",
    "obj_a",
    "a(b)",
    "{| 1, 2 |}",
    "{= a=3 }",
    "{: 1, 2 }"
];

console.log("--- Testing Parser Behavior ---");

tests.forEach(test => {
    console.log(`\nParsing: "${test}"`);
    try {
        const result = parse(test);
        console.log("Result:", JSON.stringify(result, (key, value) => {
            if (key === 'pos' || key === 'original') return undefined; // simplify output
            return value;
        }, 2));
    } catch (e) {
        console.log("Error:", e.message);
    }
});
