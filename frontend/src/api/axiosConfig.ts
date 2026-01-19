import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '';

axios.defaults.baseURL = baseURL;

export default axios;