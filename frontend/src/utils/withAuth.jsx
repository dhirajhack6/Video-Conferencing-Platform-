import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const withAuth = (WrappedComponent) => {
  return (props) => {
    const navigate = useNavigate();

    useEffect(() => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/authentication");
      }
    }, [navigate]);

    return <WrappedComponent {...props} />;
  };
};

export default withAuth;
