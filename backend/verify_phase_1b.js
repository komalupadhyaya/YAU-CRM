import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

async function verify() {
    try {
        console.log('--- Verifying Phase 1B ---');

        // 1. Get a campaign
        const campaigns = await axios.get(`${API_URL}/campaigns`);
        if (campaigns.data.length === 0) {
            console.log('No campaigns found. Skipping some tests.');
            return;
        }
        const campaignId = campaigns.data[0]._id;
        console.log(`Using campaign: ${campaignId}`);

        // 2. Get school counts
        const counts = await axios.get(`${API_URL}/schools/campaign/${campaignId}/school-counts`);
        console.log('School counts:', counts.data);

        // 3. Get a school
        const schools = await axios.get(`${API_URL}/schools/campaign/${campaignId}`);
        if (schools.data.length === 0) {
            console.log('No schools found. Skipping some tests.');
            return;
        }
        const schoolId = schools.data[0]._id;
        const initialLastContacted = schools.data[0].last_contacted;
        console.log(`Using school: ${schoolId}, initial last_contacted: ${initialLastContacted}`);

        // 4. Update status
        console.log('Updating status...');
        const patchRes = await axios.patch(`${API_URL}/schools/${schoolId}`, { status: 'Attempted Call' });
        console.log('New status:', patchRes.data.status);

        // 5. Add a note and check last_contacted
        console.log('Adding a note...');
        await axios.post(`${API_URL}/notes/${schoolId}`, { content: 'Verification note' });

        const updatedSchool = await axios.get(`${API_URL}/schools/${schoolId}`);
        console.log('New last_contacted:', updatedSchool.data.last_contacted);

        if (new Date(updatedSchool.data.last_contacted) > new Date(initialLastContacted || 0)) {
            console.log('✅ last_contacted auto-updated successfully!');
        } else {
            console.log('❌ last_contacted failed to update.');
        }

        console.log('--- Verification Complete ---');
    } catch (err) {
        console.error('Verification failed:', err.response?.data || err.message);
    }
}

verify();
