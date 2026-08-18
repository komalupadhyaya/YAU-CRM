import clientService from './client.service.js';
import webhookService from './webhook.service.js';
import knowledgeBaseService from './knowledgeBase.service.js';

export {
    clientService,
    webhookService,
    knowledgeBaseService
};

export default {
    client: clientService,
    webhook: webhookService,
    kb: knowledgeBaseService
};
