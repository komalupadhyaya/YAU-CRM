import axios from 'axios';

/**
 * Syncs an EA Lead to Constant Contact list using the V3 API.
 * This function runs asynchronously and catches its own errors to avoid blocking the caller.
 * 
 * @param {Object} lead - The lead details { name, email, phone, source }
 */
export const syncToConstantContact = async (lead) => {
    const accessToken = process.env.CONSTANT_CONTACT_ACCESS_TOKEN;
    const listId = process.env.CONSTANT_CONTACT_LIST_ID;

    // Check if API credentials are set
    if (!accessToken || !listId) {
        console.warn(
            '[Constant Contact Service] Missing credentials (CONSTANT_CONTACT_ACCESS_TOKEN or CONSTANT_CONTACT_LIST_ID) in environment. Sync skipped for:',
            lead.email
        );
        return;
    }

    try {
        console.log(`[Constant Contact Service] Syncing lead: ${lead.email}...`);

        // Split name into first and last name
        const nameParts = lead.name.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Construct Constant Contact v3 Contact Payload
        // Reference: https://developer.constantcontact.com/api_reference/index.html#!/Contacts/createContact
        const payload = {
            email_address: {
                address: lead.email,
                permission_scheme: 'implicit' // Can be implicit, explicit, etc.
            },
            first_name: firstName,
            last_name: lastName,
            create_source: 'Contact',
            list_memberships: [listId]
        };

        if (lead.phone) {
            // Clean phone number (leave only numbers)
            const cleanPhone = lead.phone.replace(/\D/g, '');
            if (cleanPhone) {
                payload.phone_numbers = [
                    {
                        phone_number: cleanPhone,
                        kind: 'mobile'
                    }
                ];
            }
        }

        // POST to Constant Contact Contacts API
        const response = await axios.post(
            'https://api.cc.email/v3/contacts',
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('[Constant Contact Service] Sync success. Status:', response.status, 'Contact ID:', response.data?.contact_id);
    } catch (error) {
        const errorMsg = error.response?.data 
            ? JSON.stringify(error.response.data) 
            : error.message;
        console.error('[Constant Contact Service] Sync failed. Error details:', errorMsg);
    }
};
