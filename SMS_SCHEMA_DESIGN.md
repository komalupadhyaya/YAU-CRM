# SMS Schema Design & Database Architecture

This document answers how SMS message data is stored in YAU-CRM, detailing the schema design, field definitions, rationale for using existing models versus creating new collections, and indexing strategies.

---

## ❓ Did We Create a New Collection or Use Existing Schemas?

**Answer**: We **did NOT create a separate new database collection**. 

Instead, we extended and standardized our **existing `EALead` and `Lead` schemas** by adding an embedded `smsHistory` array and an `unreadCount` field to both models, while continuing to write activity logs to the existing `Note` model.

---

## 📐 Schema Definitions & Code Comparison

### 1. `EALead` Schema Enhancement ([eaLead.model.js](file:///d:/YAU-CRM/backend/src/models/eaLead.model.js))

The `EALead` model uses an embedded array `smsHistory` to store 1-on-1 text message exchanges with leads who submitted the website form:

```javascript
const EALeadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: { type: String, required: true, index: true },
    source: { type: String, default: 'YAU Website' },
    dateSubmitted: { type: Date, default: Date.now },
    submissionCount: { type: Number, default: 1 },
    isConsent: { type: Boolean, default: true },
    
    // ── NEW SMS EXTENSIONS ──────────────────────────────────────────
    unreadCount: { type: Number, default: 0 },
    smsHistory: [
        {
            direction: { type: String, enum: ['inbound', 'outbound'] },
            message: String,
            timestamp: { type: Date, default: Date.now },
            isBulk: { type: Boolean, default: false },
            status: { type: String, enum: ['pending', 'sent', 'failed', 'received'], default: 'pending' },
            twilioSid: { type: String, default: null },
            isRead: { type: Boolean, default: false }
        }
    ]
}, { timestamps: true });
```

---

### 2. Main CRM `Lead` Schema Enhancement ([lead.model.js](file:///d:/YAU-CRM/backend/src/models/lead.model.js))

To bring full 2-way SMS functionality to main CRM leads (Schools, HRs, Organizations), we attached the exact same `smsHistory` structure to `LeadSchema`:

```javascript
const LeadSchema = new mongoose.Schema({
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    name: { type: String, required: true },
    telephone: String,
    status: { type: String, default: "Not Contacted" },
    assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // ── NEW SMS EXTENSIONS ──────────────────────────────────────────
    unreadCount: { type: Number, default: 0 },
    smsHistory: [{
        direction: { type: String, enum: ['inbound', 'outbound'] },
        message: String,
        timestamp: { type: Date, default: Date.now },
        isBulk: { type: Boolean, default: false },
        status: { type: String, enum: ['pending', 'sent', 'failed', 'received'], default: 'pending' },
        twilioSid: { type: String, default: null },
        isRead: { type: Boolean, default: false }
    }],

    callHistory: [...]
}, { timestamps: true });
```

---

### 3. Activity Feed Integration ([note.model.js](file:///d:/YAU-CRM/backend/src/models/note.model.js))

When an SMS is sent or received, an entry is also created in the `Note` collection (`type: 'sms'`) so it appears in the lead's main Activity Feed timeline:

```javascript
await Note.create({
    lead_id,
    content: `SMS SENT to ${toNumber}:\n${message}`,
    type: 'sms',
    metadata: { to: toNumber, message, twilio_response: { sid: twilioRes.sid } }
});
```

---

## 🔍 Why Embedded Schemas Were Chosen Over a Separate Collection

| Architectural Aspect | Embedded Schema (`EALead.smsHistory` / `Lead.smsHistory`) | Separate `SMSMessage` Collection |
| :--- | :--- | :--- |
| **Query Speed** | 🚀 **Ultra Fast** (1 single DB query retrieves lead + full chat thread) | 🐢 Slower (Requires `$lookup` aggregation joins across collections) |
| **Atomic Updates** | ✅ Updating `unreadCount` & pushing a message happens in one atomic `.save()` | Requires multi-document transactions |
| **Data Locality** | ✅ Lead data and text thread live together | Separated across tables |
| **Lead Conversion** | ✅ When an EA Lead is converted to a CRM Lead, `smsHistory` transfers cleanly | Requires re-keying foreign keys |

---

## 🗂️ Field Data Dictionary

| Field Name | Type | Options / Enum | Description |
| :--- | :--- | :--- | :--- |
| `direction` | String | `'inbound'`, `'outbound'` | Indicates if text was received from lead or sent by sales rep |
| `message` | String | Text content | The text message content |
| `timestamp` | Date | `Date.now` | Date and time message was created |
| `isBulk` | Boolean | `true`, `false` | Distinguishes 1-on-1 chat replies from campaign bulk texts |
| `status` | String | `'pending'`, `'sent'`, `'failed'`, `'received'` | Twilio message delivery status |
| `twilioSid` | String | Twilio SID string | Unique ID returned by Twilio for webhook status updates |
| `isRead` | Boolean | `true`, `false` | Tracks if user has viewed the inbound message |
| `unreadCount` | Number | Integer `>= 0` | Counter on parent Lead used for fast unread badge rendering |
