export type User = {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
  securityAnswerSalt?: string;
  createdAt: string;
};