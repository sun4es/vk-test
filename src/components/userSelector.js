import React, { Component } from 'react';
import PropTypes from 'prop-types';
import createCachedSelector from 're-reselect';

import Loader from './loader';
import './../css/userSelector.css';

import escapeStringRegExp from 'escape-string-regexp';

// Небольшие самописные утилиты для транлитерации и 
// преобразования раскладок
import { dictionary as translitDictionary } from './../utils/translit/index';
import { getAllLayouts } from './../utils/layouts/index';

// Регулярное выражение для поиска всех букв/сочетаний, для которых 
// есть соответствия в словаре транслитерации
const translitLetters = new RegExp('(' + Object.keys(translitDictionary).sort((a, b) => b.length - a.length).join('|') + ')', 'gi');

/*
 * Преобразование строки поиска в регулярное выражение.
 */
const filterToRegExps = filter => {
    // Делим строку по пробелам и обрабатываем подстроки отдельно
    return filter.split(/\s+/)
        .filter(filter => 
            filter !== '')
        .map(filter => new RegExp('^(?:' + 
                // вариант 0-n: исходная строка в различных раскладках клавиатуры с учетом вариантов транлитерации
                getAllLayouts(filter).map(({ value }) => 
                    escapeStringRegExp(value).replace(translitLetters, (...b) => ('(?:' + translitDictionary[b[1].toLowerCase()]) + ')'))
                    .join('|') + ')', 'gi')
        );
}

const filterUsers = (users, filter) => {
    if (Array.isArray(users) && filter && filter.length) {
        let regExps = filterToRegExps(filter);
        return users.filter(({ first_name, last_name }) => 
            regExps.every(regExp => [first_name, last_name].some(str => str.match(regExp)))
        );
    }   
    return null;
}

// Сначала сделал с redux/re-reselect, потом решил не усложнять без необходимости
// и хранить state в компоненте. re-reselect остался.
// Как вариант - использовать reselect и создавать селектор для каждого инстанса 
// в конструкторе компонента.
const cachedFilterUsersSelector = createCachedSelector(
    // разворачиваем исходный список всех пользователей
    state => state.allItems && state.allItems.map(id => state.itemsById[id]),
    // строка фильтра
    (state, filter) => filter,
    // фильтруем список объектов пользователей и разворачиваем обратно
    // в список идентификаторов
    (items, filter) => {
        const filteredItems = filterUsers(items, filter);
        return filteredItems ? filteredItems.map(({ id }) => id) : null;
    }
)(
    // кешируем по идентификатору селектора и строке фильтра
    (state, filter, id) => 
        id + '--' + (filter ? filter.toLowerCase() : '')
);

let selectorId = 0;

class UserSelector extends Component {

    static propTypes = {
        url: PropTypes.string.isRequired,
        itemHeight: PropTypes.number,
        visibleItemsCount: PropTypes.number,
        overscanItemsCount: PropTypes.number
    }

    static defaultProps = {
        itemHeight: 50,
        visibleItemsCount: 50,
        overscanItemsCount: 20
    }

    constructor() {
        super();

        this.id = selectorId++;
        this.timeout = null;

        this.state = this.getDefaultState();
    }

    getDefaultState() {
        return {
            itemsById: {}, 
            allItems: null,
            filteredItems: null,
            selectedItems: null,
            loading: false,
            error: null,
            offset: 0,
            activeItem: null,
        }
    }

    load() {
        const { url } = this.props;
        if (!url) {
            throw new Error('url is ' + url);
        }

        fetch(url)
            .then(response => 
                response.json())
            .then(response => {    
                this.setState({ 
                    ...this.getDefaultState(),
                    ...this.fetchItems(response)
                });
            }) 
            .catch(error => {
                this.setState({ 
                    ...this.getDefaultState(),
                    error
                });
            });

        this.setState({ 
            loading: true, 
            error: null 
        });
    }

    fetchItems(response) {
        return {
            itemsById: response.reduce((itemsById, item) => {
                itemsById[item.id] = item;
                return itemsById
            }, {}),
            allItems: response.map(item => item.id),
            filteredItems: null,

            // TODO: мб нужно сохранять список выделенных пользователей
            // при перезагрузке списка
            selectedItems: null,

            activeItem: null
        }
    }

	componentWillMount() {
		this.load();
	}

    onInputClick(e) {
        this.input.focus();
    }

    onFilterChange(e) {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        const value = e.target.value;
        this.timeout = setTimeout(() => this.filter(value), 16);
    }

    filter(value) {
        const filteredItems = cachedFilterUsersSelector(this.state, value, this.id);
        this.setState({
            filteredItems
        });

        this.scrollListToTop();

        if (filteredItems && filteredItems.length) {
            this.activate(filteredItems[0]);
        } else {
            this.activate(null);
        }
    }

    onListScroll(e) {
        this.setState({ offset: this.list.scrollTop });
    }

    scrollListToTop() {
        this.list.scrollTop = 0;
    }

    getSelectedItemIndex(id) {
        const { selectedItems } = this.state;
        return selectedItems ? selectedItems.indexOf(id) : -1;
    }

    isItemSelected(id) {
        return this.getSelectedItemIndex(id) !== -1;
    }

    toggleItem(id, resetFilter = false) {
        const { selectedItems } = this.state;
        const i = this.getSelectedItemIndex(id);
        if (i === -1) {
            this.setState({
                selectedItems: selectedItems ? [...selectedItems, id] : [id]
            });
            this.resetFilter();
        } else {
            this.setState({
                selectedItems: selectedItems.filter(itemId => itemId !== id)
            });
        }
        this.input.focus();
    }

    getActiveItemId() {
        const { filteredItems, isFiltered } = this.state;
        return isFiltered && (filteredItems && filteredItems.length ? filteredItems[0] : null);
    }

    isFiltered() {
        const { filteredItems } = this.state;
        return filteredItems !== null;
    }

    resetFilter() {
        this.input.value = '';

        if (this.isFiltered()) {
            this.filter(null);
        }
    }

    activate(id) {
        this.setState({
            activeItem: id
        });
    }

    onKeyDown(e) {
        const { 
            allItems, 
            filteredItems, 
            activeItem
        } = this.state;

        if (activeItem && e.keyCode === 13) {
            this.toggleItem(activeItem);
        } else {
            const items = filteredItems || allItems;
            if (items) {
                const index = activeItem ? items.indexOf(activeItem) : -1;
                if (e.keyCode === 38 && index > 0) {
                    this.activate(items[index - 1]);
                } else 
                if (e.keyCode === 40 && index < (items.length - 1)) {
                    this.activate(items[index + 1]);
                } 
            }
        }
    }

    onListMouseEnter(e) {
        this.activate(null);
    }

    render() {
        const {  
            itemsById,
            allItems, 
            filteredItems,
            selectedItems,
            loading, 
            offset,
            activeItem
        } = this.state;

        const items = filteredItems || allItems || [];
        const isSelected = selectedItems && selectedItems.length;

        if (loading) {
            return <Loader />
        } 
        
        // Тестовые данные содержат 1000 записей, и рендер списка занимает заметное время.
        // Поэтому реализовал простой настраиваемый виртуальный скроллинг с фиксированной высотой элемента.
        let {
            itemHeight,
            visibleItemsCount,
            overscanItemsCount
        } = this.props;

        let start = (offset / itemHeight) | 0;
        if (overscanItemsCount) {
            start = Math.max(0, start - (start % overscanItemsCount));
            visibleItemsCount += overscanItemsCount;
        }

        let end = start + 1 + visibleItemsCount;
        let selection = items.slice(start, end);

        return (
            <div className="user-selector" onKeyDown={e => this.onKeyDown(e)}>
                <div 
                    className="user-selector__input user-selector-input"
                    onClick={e => this.onInputClick(e)}
                    ref={inputArea => this.inputArea = inputArea}>
                    <div className="user-selector-input__inner">
                        {selectedItems && selectedItems.map(id => (
                        <span key={id} className="user-selector-input__item user-selector-input-item">
                            <span className="user-selector-input-item__label">{`${itemsById[id].first_name} ${itemsById[id].last_name}`}</span>
                            <span className="user-selector-input-item__remove" onClick={() => this.toggleItem(id)}></span>
                        </span>
                        ))}
                        <input 
                            className="user-selector-input__input" 
                            onChange={e => this.onFilterChange(e)}
                            ref={input => this.input = input}
                            placeholder={isSelected ? '' : 'Введите имя или фамилию'} />
                    </div>
                </div>
                <div 
                    className="user-selector__list user-selector-list" 
                    ref={list => this.list = list} 
                    onScroll={e => this.onListScroll(e)}
                    onMouseEnter={e => this.onListMouseEnter(e)}>
                    <div 
                        className="user-selector-list__wrapper" 
                        style={{ height: items.length * itemHeight }}>
                        <ul 
                            className="user-selector-list__inner" 
                            style={{ top: start * itemHeight }}>

                            {selection.map((id, i) => (
                            <li 
                                key={id} 
                                className={`user-selector-list__item user-selector-item ${this.isItemSelected(id) ? 'user-selector-item--selected' : ''} ${id === activeItem ? 'user-selector-item--active' : ''}`}
                                onClick={() => this.toggleItem(id)}>
                                <div className="user-selector-item__image"></div>
                                <div className="user-selector-item__name">{`${itemsById[id].first_name} ${itemsById[id].last_name}`}</div>
                            </li>))}
                        </ul>
                    </div>
                </div>
            </div>
        );
    }
}

export default UserSelector;
