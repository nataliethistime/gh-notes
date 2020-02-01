$(function () {
  const CLASS = 'active';

  const $layout = $('#layout');
  const $menu = $('#menu');
  const $menuLink = $('#menuLink');
  const $content = $('#main');

  const toggleAll = (e) => {
    e.preventDefault();
    $layout.toggleClass(CLASS);
    $menu.toggleClass(CLASS);
    $menuLink.toggleClass(CLASS);
  };

  const ensureClosed = (e) => {
    e.preventDefault();
    $layout.removeClass(CLASS);
    $menu.removeClass(CLASS);
    $menuLink.removeClass(CLASS);
  };

  $menuLink.click(toggleAll);
  $content.click(ensureClosed);

  console.log('Initializing pjax');
  $(document).pjax('a', '#main');
  $('#main').on('pjax:success', ensureClosed(e));
});
