import { describe, it, expect } from "vitest";
import { parseSpintax } from "./spintax.js";

describe("parseSpintax", () => {
  it("returns unchanged text when no spintax syntax is present", () => {
    expect(parseSpintax("Hello world")).toBe("Hello world");
    expect(parseSpintax("")).toBe("");
  });

  it("selects options correctly with seeded deterministic RNG", () => {
    const template = "{Hello|Hi|Hey} there!";

    // rng returns 0 -> index 0 ("Hello")
    expect(parseSpintax(template, () => 0.0)).toBe("Hello there!");

    // rng returns 0.4 -> index 1 ("Hi")
    expect(parseSpintax(template, () => 0.4)).toBe("Hi there!");

    // rng returns 0.8 -> index 2 ("Hey")
    expect(parseSpintax(template, () => 0.8)).toBe("Hey there!");
  });

  it("handles multiple separate spintax groups in one string", () => {
    const template = "{Hi|Hello} {John|Jane}, {how are you|hope you are well}!";
    const rng = () => 0.0; // always pick first option
    expect(parseSpintax(template, rng)).toBe("Hi John, how are you!");
  });

  it("resolves nested spintax recursively", () => {
    const template = "{Welcome to {our store|the boutique}|{Hello|Greetings}}!";

    // If first choice is "Welcome to {our store|the boutique}" and inner choice is "the boutique":
    // Mock RNG alternating 0.1 then 0.9
    let call = 0;
    const alternatingRng = () => {
      call++;
      return call % 2 === 1 ? 0.9 : 0.1;
    };

    const result = parseSpintax(template, alternatingRng);
    expect(typeof result).toBe("string");
    expect(result).not.toContain("{");
    expect(result).not.toContain("}");
  });

  it("tolerates empty options", () => {
    const template = "Discount {20%|} available!";
    expect(parseSpintax(template, () => 0.0)).toBe("Discount 20% available!");
    expect(parseSpintax(template, () => 0.6)).toBe("Discount  available!");
  });
});
