import { Router } from 'express';
import {
  examples,
  executePdaController,
  executeTmController,
  health,
  runTestsController,
  testCases,
  validate,
} from '../controllers';
import { validateBody } from '../middleware/validate';
import { pdaExecuteSchema, testRunSchema, tmExecuteSchema, validateSchema } from '../schemas/requests';

export const apiRouter = Router();

apiRouter.get('/health', health);
apiRouter.get('/examples', examples);
apiRouter.get('/tests/cases', testCases);
apiRouter.post('/machines/validate', validateBody(validateSchema), validate);
apiRouter.post('/pda/execute', validateBody(pdaExecuteSchema), executePdaController);
apiRouter.post('/tm/execute', validateBody(tmExecuteSchema), executeTmController);
apiRouter.post('/tests/run', validateBody(testRunSchema), runTestsController);
