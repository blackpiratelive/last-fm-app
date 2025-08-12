const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
    // Retrieve the API key and secret from Netlify's environment variables
    const { LASTFM_API_KEY, LASTFM_API_SECRET } = process.env;
    const API_URL = 'https://ws.audioscrobbler.com/2.0/';

    try {
        const queryParams = event.queryStringParameters;

        // Special action to get the login URL without exposing the API key
        if (queryParams && queryParams.action === 'getLoginUrl') {
            const apiKey = LASTFM_API_KEY;
            const callback = queryParams.callback;
            const authUrl = `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=${callback}`;
            
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ authUrl }),
            };
        }

        let params;
        // The HTTP method (GET or POST) determines how we get the parameters
        if (event.httpMethod === 'GET') {
            params = queryParams;
        } else { // POST
            params = JSON.parse(event.body);
        }

        const isSignedRequest = params.method === 'auth.getSession' || params.method === 'track.love';
        
        // Always add API key for Last.fm requests
        params.api_key = LASTFM_API_KEY;

        let finalUrl = API_URL;
        let options = {
            method: 'GET',
        };

        if (isSignedRequest) {
            // Signed requests must be POST and have a signature
            options.method = 'POST';
            
            // Create a copy of params for signature, excluding 'format'
            const paramsForSig = { ...params };
            delete paramsForSig.format;

            const orderedParams = Object.keys(paramsForSig).sort().reduce((obj, key) => {
                obj[key] = paramsForSig[key];
                return obj;
            }, {});

            let sig_string = '';
            for (const key in orderedParams) {
                sig_string += key + orderedParams[key];
            }
            sig_string += LASTFM_API_SECRET;
            
            params.api_sig = crypto.createHash('md5').update(sig_string, 'utf-8').digest('hex');
            
            // All params, including api_sig, go into the form data body
            const formData = new URLSearchParams();
            // Add format=json for the actual request to Last.fm
            params.format = 'json';
            for (const key in params) {
                formData.append(key, params[key]);
            }
            options.body = formData;
            options.headers = {'Content-Type': 'application/x-www-form-urlencoded'};

        } else { // Unsigned GET request
            params.format = 'json';
            const queryString = Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
            finalUrl += `?${queryString}`;
        }

        const response = await fetch(finalUrl, options);
        const data = await response.json();

        // Check for errors from the Last.fm API itself
        if (data.error) {
             console.error(`Last.fm API Error: ${data.message}`);
             return {
                statusCode: 400, // Bad Request or appropriate error code
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify(data),
            };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error('Error in Netlify function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
        };
    }
};
