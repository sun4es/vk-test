import React, { Component } from 'react';

import './../css/app.css';
import UserSelector from '../components/userSelector';

export default class App extends Component {
    render() {
        return (
            <div className="app">
                <UserSelector url="https://sun4es.github.io/vk-test/users.json" />
                <UserSelector url="https://sun4es.github.io/vk-test/users.json" />
                <UserSelector url="https://sun4es.github.io/vk-test/users.json" />
            </div>
        );
    }
}

