import { requestClient } from '#/api/request';

export interface WarningEliminateParams {
  warning_log_id: string;
  reason: string;
  description: string;
  type: string;
  attachments: string[];
}

export function warningEliminate(data: WarningEliminateParams) {
  return requestClient.post('/api/v1/paxy/warning/warningEliminate', data);
}

