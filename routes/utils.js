const {baseUrl} = require('../config');
const formatLinkHeader = require('format-link-header');

/**
 * Parses the pagination parameters (i.e. page & page size) from the request.
 *
 * @param {ExpressRequest} req - The Express request object
 * @returns An object with "page" and "pageSize" properties
 */
exports.getPaginationParameters = function (req) {

    // Parse the "page" URL query parameter indicating the index of the first element that should be in the response
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) {
        page = 1;
    }

    // Parse the "pageSize" URL query parameter indicating how many elements should be in the response
    let pageSize = parseInt(req.query.pageSize, 10);
    if (isNaN(pageSize) || pageSize < 0 || pageSize > 100) {
        pageSize = 100;
    }

    return { page, pageSize };
};

/**
 * Adds a Link header to the response (if applicable).
 *
 * @param {String} resourceHref - The hyperlink reference of the collection (e.g. "/api/people")
 * @param {Number} page - The page being listed
 * @param {Number} pageSize - The page size
 * @param {Number} total - The total number of elements
 * @param {ExpressResponse} res - The Exprss response object
 */
exports.addLinkHeader = function (resourceHref, page, pageSize, total, res) {

    const links = {};
    const url = baseUrl + resourceHref;
    const maxPage = Math.ceil(total / pageSize);

    // Add first & prev links if current page is not the first one
    if (page > 1) {
        links.first = { rel: 'first', url: `${url}?page=1&pageSize=${pageSize}` };
        links.prev = { rel: 'prev', url: `${url}?page=${page - 1}&pageSize=${pageSize}` };
    }

    // Add next & last links if current page is not the last one
    if (page < maxPage) {
        links.next = { rel: 'next', url: `${url}?page=${page + 1}&pageSize=${pageSize}` };
        links.last = { rel: 'last', url: `${url}?page=${maxPage}&pageSize=${pageSize}` };
    }

    // If there are any links (i.e. if there is more than one page),
    // add the Link header to the response
    if (Object.keys(links).length > 1) {
        console.log(links);
        res.set('Link', formatLinkHeader(links));
    }
}
