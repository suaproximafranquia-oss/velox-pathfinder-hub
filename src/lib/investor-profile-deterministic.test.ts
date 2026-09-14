import { describe, expect, it } from "vitest";
import { SELF_ASSESSMENT_QUESTIONS, profileKeyForScore, scoreSelfAssessment } from "./investor-profile-deterministic";

describe("leitura determinística do investidor", () => {
  it.each([[0, "EXPLORADOR"], [2, "EXPLORADOR"], [3, "ANALITICO"], [5, "ANALITICO"], [6, "HIBRIDO"], [8, "HIBRIDO"], [9, "PREPARADOR"], [11, "PREPARADOR"], [12, "CONSTRUTOR"], [14, "CONSTRUTOR"]])("classifica score %i como %s", (score, expected) => {
    expect(profileKeyForScore(score)).toBe(expected);
  });

  it("é estável e preserva as respostas reais", () => {
    const selected = [0, 1, 2, 0, 1, 2, 0];
    const result = scoreSelfAssessment(selected);
    expect(scoreSelfAssessment(selected)).toEqual(result);
    expect(result).toMatchObject({ score: 8, profileKey: "HIBRIDO" });
    expect(result.answers).toHaveLength(SELF_ASSESSMENT_QUESTIONS.length);
    expect(result.answers[0]?.answer).toBe(SELF_ASSESSMENT_QUESTIONS[0]?.options[0]);
  });
});