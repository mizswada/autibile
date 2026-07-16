const DEFAULT_NUMBER_CONFIG = {
  inputType: "number",
  min: 0,
  max: 10,
  step: 1,
  defaultValue: 0,
  minLabel: "",
  maxLabel: "",
};

let cachedNumberAnswerTypeLookupId = null;

export async function getNumberAnswerTypeLookupId() {
  if (cachedNumberAnswerTypeLookupId) {
    return cachedNumberAnswerTypeLookupId;
  }

  const lookup = await prisma.lookup.findFirst({
    where: {
      refCode: "answerType",
      OR: [{ value: "number" }, { title: "Number" }],
    },
    select: { lookupID: true },
  });

  cachedNumberAnswerTypeLookupId = lookup?.lookupID ?? null;
  return cachedNumberAnswerTypeLookupId;
}

export async function isNumberAnswerType(answerType) {
  if (answerType === null || answerType === undefined || answerType === "") {
    return false;
  }

  const numberTypeId = await getNumberAnswerTypeLookupId();
  return numberTypeId !== null && parseInt(answerType) === numberTypeId;
}

export function parseNumberScoringConfig(scoringConfig) {
  if (!scoringConfig) {
    return { ...DEFAULT_NUMBER_CONFIG };
  }

  try {
    const parsed =
      typeof scoringConfig === "string" ? JSON.parse(scoringConfig) : scoringConfig;

    if (parsed?.inputType !== "number") {
      return { ...DEFAULT_NUMBER_CONFIG };
    }

    const min = Number(parsed.min ?? DEFAULT_NUMBER_CONFIG.min);
    const max = Number(parsed.max ?? DEFAULT_NUMBER_CONFIG.max);
    const step = Number(parsed.step ?? DEFAULT_NUMBER_CONFIG.step);
    let defaultValue = Number(
      parsed.defaultValue ?? parsed.default ?? DEFAULT_NUMBER_CONFIG.defaultValue,
    );

    const safeMin = Number.isFinite(min) ? min : DEFAULT_NUMBER_CONFIG.min;
    const safeMax = Number.isFinite(max) ? max : DEFAULT_NUMBER_CONFIG.max;
    const safeStep = Number.isFinite(step) && step > 0 ? step : DEFAULT_NUMBER_CONFIG.step;

    if (safeMin >= safeMax) {
      return { ...DEFAULT_NUMBER_CONFIG };
    }

    if (!Number.isFinite(defaultValue)) {
      defaultValue = safeMin;
    }

    if (defaultValue < safeMin) defaultValue = safeMin;
    if (defaultValue > safeMax) defaultValue = safeMax;

    return {
      inputType: "number",
      min: safeMin,
      max: safeMax,
      step: safeStep,
      defaultValue,
      minLabel: parsed.minLabel || "",
      maxLabel: parsed.maxLabel || "",
    };
  } catch (error) {
    return { ...DEFAULT_NUMBER_CONFIG };
  }
}

export function buildNumberScoringConfig(config = {}) {
  const parsed = parseNumberScoringConfig({
    inputType: "number",
    ...config,
  });

  return JSON.stringify(parsed);
}

export function validateNumberConfigInput(config = {}) {
  const min = Number(config.min);
  const max = Number(config.max);
  const step = Number(config.step);
  const defaultValue = Number(config.defaultValue ?? config.default ?? min);

  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) {
    return { ok: false, message: "Min, max, and step must be valid numbers" };
  }

  if (min >= max) {
    return { ok: false, message: "Min must be less than max" };
  }

  if (step <= 0) {
    return { ok: false, message: "Step must be greater than 0" };
  }

  if (!Number.isFinite(defaultValue) || defaultValue < min || defaultValue > max) {
    return { ok: false, message: "Default value must be within the min/max range" };
  }

  return { ok: true, config: parseNumberScoringConfig(buildNumberScoringConfig(config)) };
}

export function validateNumericAnswerValue(value, config) {
  const parsedConfig = parseNumberScoringConfig(config);
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return { ok: false, message: "Numeric answer must be a valid number" };
  }

  if (numericValue < parsedConfig.min || numericValue > parsedConfig.max) {
    return {
      ok: false,
      message: `Numeric answer must be between ${parsedConfig.min} and ${parsedConfig.max}`,
    };
  }

  return { ok: true, value: numericValue, config: parsedConfig };
}

export function attachNumberConfigToQuestion(question) {
  if (!question) return question;

  const numberConfig = parseNumberScoringConfig(question.scoring_config);
  if (numberConfig.inputType !== "number") {
    return question;
  }

  return {
    ...question,
    number_config: numberConfig,
  };
}

export async function enrichQuestionWithNumberConfig(question) {
  if (!question) return question;

  const isNumber = await isNumberAnswerType(question.answer_type);
  if (!isNumber) {
    return question;
  }

  return attachNumberConfigToQuestion(question);
}

export async function resolveScoringConfigForSave({ answer_type, number_config }) {
  const isNumber = await isNumberAnswerType(answer_type);
  if (!isNumber) {
    return { shouldUpdate: false };
  }

  const validation = validateNumberConfigInput(number_config || {});
  if (!validation.ok) {
    return { shouldUpdate: false, error: validation.message };
  }

  return {
    shouldUpdate: true,
    scoring_config: buildNumberScoringConfig(validation.config),
  };
}
