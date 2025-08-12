const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
    // Retrieve the API key and secret from Netlify's environment variables
    const { LASTFM_API_KEY, LASTFM_API_SECRET } = process.env;
    const API_URL = 'https://ws.audioscrobbler.com/2.0/';

    try {
        let params;
        // The HTTP method (GET or POST) determines how we get the parameters
        if (event.httpMethod === 'GET') {
            params = event.queryStringParameters;
        } else {
            params = JSON.parse(event.body);
        }

        // Add the API key to every request
        params.api_key = LASTFM_API_KEY;
        params.format = 'json';

        let finalUrl = API_URL;
        let options = {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        };

        // For methods that require a signature (authentication or writing data)
        if (params.method === 'auth.getSession' || params.method === 'track.love') {
            // Order parameters alphabetically
            const orderedParams = Object.keys(params).sort().reduce((obj, key) => {
                obj[key] = params[key];
                return obj;
            }, {});

            // Create the signature string
            let sig_string = '';
            for (const key in orderedParams) {
                if (key !== 'format') { // format is not included in signature
                   sig_string += key + orderedParams[key];
                }
            }
            sig_string += LASTFM_API_SECRET;
            
            // Add the MD5 hashed signature to the parameters
            params.api_sig = crypto.createHash('md5').update(sig_string, 'utf-8').digest('hex');

            // Signed requests must be POST
            options.method = 'POST';
            const formData = new URLSearchParams();
            for (const key in params) {
                formData.append(key, params[key]);
            }
            options.body = formData;
            options.headers = {'Content-Type': 'application/x-www-form-urlencoded'};

        } else {
            // For simple GET requests
            const queryString = Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
            finalUrl += `?${queryString}`;
        }

        // Make the actual API call to Last.fm
        const response = await fetch(finalUrl, options);
        const data = await response.json();

        // Return the data to the front-end
        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" }, // Allow requests from your site
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error('Error in Netlify function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    }
};
