const server = {
  dev: "http://localhost:8000",
  prod: "http://video-confrencing-f3aj.onrender.com/",
};

const baseURL =
  import.meta.env.MODE === "development" ? server.dev : server.prod;

export default baseURL;
