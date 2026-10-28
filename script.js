document.querySelectorAll('#year, .year').forEach((el) => { el.textContent = new Date().getFullYear(); });

const observer = new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    if (isIntersecting) target.classList.add('in-view');
  });
}, { threshold: 0.18 });

document.querySelectorAll('.project, .service-list article, .manifesto-copy').forEach((el) => observer.observe(el));
