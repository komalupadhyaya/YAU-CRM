import dotenv from 'dotenv';
dotenv.config();

import { YAU_KNOWLEDGE_BASE, getKnowledgeBasePromptContext } from './services/ai/knowledgeBase.service.js';
import { aiQueue } from './services/ai/queue.service.js';
import { calculateLeadScore } from './services/ai/scoring.service.js';

async function testAiLayer() {
    console.log('=== TESTING YAU CRM AI INTELLIGENCE LAYER ===');
    console.log('1. Knowledge Base Context preview:');
    console.log(getKnowledgeBasePromptContext().slice(0, 200) + '...\n');

    console.log('2. AI Queue Status:');
    console.log(aiQueue.getStatus());

    console.log('\n3. Testing Rule-based / AI Lead Scoring Fallback:');
    const mockLead = {
        name: 'Maria Garcia',
        source: 'EA Form',
        county: "Prince George's County",
        sport: 'Soccer',
        isConsent: true,
        smsHistory: [{ direction: 'inbound', message: 'Yes interested!' }]
    };
    const scoreResult = await calculateLeadScore(mockLead);
    console.log('Scoring Result:', scoreResult);

    console.log('=== TEST COMPLETED SUCCESSFULLY ===');
}

testAiLayer().catch(err => console.error('Test failed:', err));
