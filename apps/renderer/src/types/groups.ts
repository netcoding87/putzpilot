export type ManualGroup = {
  id: string;
  personIds: string[];
  createdAt: number;
};

export type GroupValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};
