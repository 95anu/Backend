require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { Client } = require('@notionhq/client'); // Import Notion SDK
const app = express();
const PORT = process.env.PORT || 5500;
const notion = new Client({ auth: process.env.NOTION_API_KEY });

app.use(cors());

async function scrapeResults() {
    const url = 'https://govdotin.com/keralalottery/';
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const results = [];

    $('div.results').each((i, element) => {
        const text = $(element).text().trim().replace(/\n+/g, '\n');
        results.push(text.split('\n'));
    });

    const flattenedList = results.flat();
    return flattenedList;
}

async function processFlatList() {
    const flatList = await scrapeResults();
    return flatList.map(item => {
        if (/^[a-zA-Z]/.test(item)) {
            // Return alphanumeric strings as they are
            const chunks = item.match(/.{1,6}/g);
            return chunks;
        } else {
            // Split numeric strings into 4-digit chunks
            const chunks = item.match(/.{1,4}/g);
            return chunks;
        }
    }).flat(); // Flatten the resulting array of arrays
}


// Fetch blocks from a Notion page
async function fetchNotionData() {
    try {
        const pageId = process.env.NOTION_PAGE_ID; // Set your Notion page ID in the environment variables
        const response = await notion.blocks.children.list({
            block_id: pageId, // Replace with your page block ID
        });

        // Extract and return relevant data from the response
        console.log(response);
        return response.results.map(block => {
            // Assuming you want text content from paragraph blocks, adjust as needed
            if (block.type === 'paragraph') {
                return block.paragraph.rich_text[0]?.text.content || '';
            }
            return ''; // Skip blocks without text content
        }).filter(content => content !== ''); // Filter out empty strings

    } catch (error) {
        console.error('Error fetching data from Notion:', error);
        throw error;
    }
}


// Endpoint to get processed elements
app.get('/common_elements', async (req, res) => {
    try {
        const flatList = await processFlatList();
        const notionData = await fetchNotionData();
        // Find common elements
        const commonElements = flatList.filter(item => notionData.includes(item));

        res.json({ commonElements });
    } catch (error) {
        console.error('Error processing common elements:', error);
        res.status(500).json({ error: 'Failed to process results' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}/common_elements`);
});
