import axios from 'axios';
import toast from 'react-hot-toast';

// Use environment variable or fallback to production URL
const API_URL = import.meta.env.VITE_API_URL || 'https://emergency-dispatch-system-x11l.onrender.com/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Frontend request rate limiting logic
let requestCount = 0;
const MAX_REQUESTS_PER_SECOND = 15;

// Reset counter every second
setInterval(() => {
    requestCount = 0;
}, 1000);

// Add a request interceptor to attach the token and enforce rate limits (Middleware)
api.interceptors.request.use(
    (config) => {
        // Rate limiting check
        requestCount++;
        if (requestCount > MAX_REQUESTS_PER_SECOND) {
            if (requestCount === MAX_REQUESTS_PER_SECOND + 1) {
                toast.error("Slow down! Too many requests.");
            }
            return Promise.reject(new Error("Frontend Rate Limit Exceeded: Please wait before making more requests."));
        }

        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle errors systematically (Middleware)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            if (error.response.status === 401) {
                // Clear token and redirect to login if token is invalid/expired
                localStorage.removeItem('token');
                // Avoid rapid continuous re-renders by checking path
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            } else if (error.response.status === 429) {
                // Backend rate limit reached
                toast.error("Server is busy. You are making too many requests. Please try again in a moment.");
            }
        }
        return Promise.reject(error);
    }
);

export default api;
