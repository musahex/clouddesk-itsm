declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: 'requester' | 'support_agent' | 'admin';
        name: string;
      };
    }
  }
}

export {};
