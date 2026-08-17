/**
 * knowledgeBase.service.js
 * ─────────────────────────────────────────────────────────────────
 * YAU Sports reference context & Knowledge Base for AI Prompts.
 * Contains information about sports programs, counties, pricing structure,
 * practice schedules, and standard FAQs.
 * ─────────────────────────────────────────────────────────────────
 */

export const YAU_KNOWLEDGE_BASE = {
    organizationName: "YAU Sports (Youth Athlete University)",
    website: "https://youthathleteuniversity.org",
    email: "play@yausports.com",
    programTypes: [
        "Youth Athletics Programs",
        "After-School Sports Enrichment",
        "Elementary & Middle School Sports Clinics",
        "Summer Sports Camps",
        "Soccer, Basketball, Track & Field, Flag Football"
    ],
    primaryCounties: [
        "Prince George's County",
        "Montgomery County",
        "Fairfax County",
        "Anne Arundel County",
        "Howard County",
        "Washington D.C."
    ],
    standardFaqs: [
        {
            topic: "Locations & Practice Venues",
            answer: "We run programs directly at local elementary and middle schools, community centers, and parks across Prince George's County, Montgomery County, and surrounding areas. Specific locations depend on the sport and season."
        },
        {
            topic: "Age Groups & Eligibility",
            answer: "Our programs cater to youth from PK-5 (elementary) up to middle school (grades 6-8). Programs are grouped by grade level and skill tier."
        },
        {
            topic: "Practice & Session Schedules",
            answer: "After-school sessions typically run 1 to 2 times a week right after dismissal (e.g. 3:30 PM - 5:00 PM). Weekend clinics usually take place Saturday mornings."
        },
        {
            topic: "Pricing & Registration",
            answer: "Pricing varies depending on season duration and school partnership, generally ranging from $120 to $220 per 6-8 week session including jersey and equipment."
        },
        {
            topic: "Partnership with Schools / Organizations",
            answer: "YAU partners directly with public, private, and charter schools to provide certified coaches, equipment, curriculum, and safety management at no budget cost to the school."
        }
    ]
};

export function getKnowledgeBasePromptContext() {
    const faqsFormatted = YAU_KNOWLEDGE_BASE.standardFaqs
        .map(f => `Q: ${f.topic}\nA: ${f.answer}`)
        .join('\n\n');

    return `YAU SPORTS ORGANIZATION CONTEXT:
- Organization: ${YAU_KNOWLEDGE_BASE.organizationName}
- Main Email: ${YAU_KNOWLEDGE_BASE.email}
- Key Counties: ${YAU_KNOWLEDGE_BASE.primaryCounties.join(', ')}
- Core Offerings: ${YAU_KNOWLEDGE_BASE.programTypes.join(', ')}

FREQUENTLY ASKED QUESTIONS (Use these answers when responding to leads):
${faqsFormatted}`;
}

export default { YAU_KNOWLEDGE_BASE, getKnowledgeBasePromptContext };
