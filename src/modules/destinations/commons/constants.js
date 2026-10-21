/**
 * Defines destination table and request paging limits.
 * Shared constants keep validation and repository code aligned.
 */
module.exports = {
  TABLE_NAME: 'destinations',
  LEVELS: ['L0', 'L1', 'L2', 'L3', 'L4'],
  LINK_POLICIES: ['allowed', 'max_one_link', 'no_links'],
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200
};
