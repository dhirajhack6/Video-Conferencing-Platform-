import React from 'react';
import "../App.css";
import { Link } from "react-router-dom";
export default function LandingPage() {
  return (
    <div className="landingPageContainer">
      <div>
        <nav>
          <div className='navHeader'>
            <h2>Apna Video Call</h2>
          </div>
          <div className='navlist'>
            <p onClick={() => window.location.href = "/join"}>Join as Guest</p>
            <p onClick={() => window.location.href = "/authentication"}>Register</p>
            <div role="button">
              <Link to="/authentication" style={{ textDecoration: 'none', color: 'inherit' }}>
                <p>Login</p>
              </Link>
            </div>
          </div>
        </nav>

        <div className="landingMainContainer">
          <div>
            <h1> <span style={{ color: "#FF9838" }}>Connect</span> with your loved ones</h1>

            <p> Cover a distance by Apna video call </p>

            <div role="button">
              <Link to={"/authentication"}> Get Started</Link>
            </div>
          </div>

          <div>
            <img src="/mobile.png" alt="Video Call Illustration" />
          </div>
        </div>

      </div>
    </div>
  );
}

